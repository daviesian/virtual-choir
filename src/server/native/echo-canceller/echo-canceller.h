
// M_PI isn't defined on Windows.
#ifndef M_PI
    #define M_PI 3.14159265358979323846
#endif


#include "lib/numeric.h"
#include "lib/fft.h"
#include <complex>

class EchoCanceller {
	using complex = std::complex<double>;
	using RealArray = numeric::FreeArray<double>;
	using ComplexArray = numeric::FreeArray<complex>;

	double sampleRate;
	double impulseMs = 1000;
	double limitPreDelayMs = 20;
	double subtractionMs = 100;

	RealArray getWindow(size_t chunkSamples, size_t chunkStep) {
		RealArray window(chunkSamples);
		double overlapFactor = 2.0*chunkStep/chunkSamples;
		for (size_t i = 0; i < chunkSamples; i++) {
			double r = (i + 0.5)/chunkSamples;
			window[i] = 0.5 - 0.5*cos(2*M_PI*r);
			double s = sin(M_PI*r), c = cos(M_PI*r);
			window[i] = s*s/sqrt(s*s*s*s + c*c*c*c);
			window[i] *= sqrt(overlapFactor);
		}
		return window;
	}

public:
	EchoCanceller(double sampleRate) : sampleRate(sampleRate) {}

	void cancel(double *speakerSamples, size_t speakerLength, double *micSamples, size_t micLength) {
		auto speaker = numeric::wrap(speakerSamples, speakerLength);
		auto mic = numeric::wrap(micSamples, micLength);

		linearRemoval(speaker, mic);
		// Strength: between 0 and 1
		energySuppression(speaker, mic, 0.5);
	}

	template <typename Array1, typename Array2>
	void linearRemoval(Array1 &speaker, Array2 &mic) {
		size_t chunkSamples = (int)(sampleRate*impulseMs*0.001);
		size_t chunkStep = chunkSamples/4;

		ComplexArray extract(chunkSamples);
		ComplexArray speakerSpectrum(chunkSamples), micSpectrum(chunkSamples);

		ComplexArray crossSum(chunkSamples);
		RealArray speakerEnergy(chunkSamples);
		crossSum.fill(0);
		speakerEnergy.fill(0);

		size_t sharedLength = std::min(speaker.size(), mic.size());
		RealArray window = getWindow(chunkSamples, chunkStep);
		signalsmith::FFT<double> fft(chunkSamples);
		ComplexArray output(sharedLength);

		// Estimate impulse on a per-frequency basis
		for (size_t position = 0; position + chunkSamples < sharedLength; position += chunkStep) {
			extract = speaker.slice(position, chunkSamples, 1)*window;
			fft.fft(&extract[0], &speakerSpectrum[0]);
			
			extract = mic.slice(position, chunkSamples, 1)*window;
			fft.fft(&extract[0], &micSpectrum[0]);

			for (size_t i = 0; i < chunkSamples; ++i) {
				crossSum[i] += micSpectrum[i]*conj(speakerSpectrum[i]);
				speakerEnergy[i] += norm(speakerSpectrum[i]);
			}
		}

		// Limit pre-delay by fading before peak
		ComplexArray impulseSpectrum(chunkSamples);
		ComplexArray impulse(chunkSamples);
		for (size_t i = 0; i < chunkSamples; ++i) {
			impulseSpectrum[i] = crossSum[i]/speakerEnergy[i];
		}
		fft.ifft(&impulseSpectrum[0], &impulse[0]);
		impulse /= impulse.size();
		int peakIndex = 0;
		double peakAbs = 0;
		for (size_t i = 0; i < chunkSamples; i++) {
			double a = abs(impulse[i]);
			if (a > peakAbs) {
				peakAbs = a;
				peakIndex = i;
			}
		}
		if (peakIndex > (int)chunkSamples/2) peakIndex -= chunkSamples;

		int cropBefore = -limitPreDelayMs*0.001*sampleRate;
		int midPoint = chunkSamples/2;
		for (size_t i = 0; i < chunkSamples; i++) {
			int i2 = i - peakIndex;
			if (i2 < -midPoint) i2 += chunkSamples;
			if (i2 > midPoint) i2 -= chunkSamples;
			if (i2 < cropBefore) {
				impulse[i] = 0;
			}
		}
		fft.fft(&impulse[0], &impulseSpectrum[0]);

		int shiftSamples = peakIndex;

		// Apply estimated impulse and subtract
		output.fill(0);
		for (size_t position = 0; position + chunkSamples < sharedLength; position += chunkStep) {
			extract = speaker.slice(position, chunkSamples, 1)*window;
			fft.fft(&extract[0], &speakerSpectrum[0]);
			
			extract = mic.slice(position, chunkSamples, 1)*window;
			fft.fft(&extract[0], &micSpectrum[0]);

			for (size_t i = 0; i < chunkSamples; ++i) {
				micSpectrum[i] -= impulseSpectrum[i]*speakerSpectrum[i];
			}

			fft.ifft(&micSpectrum[0], &extract[0]);
			extract /= (double)chunkSamples;

			output.slice(position, chunkSamples, 1) += extract*window;
		}
		for (size_t i = 0; i < mic.size(); ++i) {
			int i2 = i + shiftSamples;
			if (i2 >= 0 && i2 < (int)output.size()) {
				mic[i] = output[i2].real();
			} else {
				mic[i] = 0;
			}
		}
	}

	template <typename Array1, typename Array2>
	void energySuppression(Array1 &speaker, Array2 &mic, double strength) {
		size_t chunkSamples = (int)(sampleRate*subtractionMs*0.001);
		size_t chunkStep = chunkSamples/4;

		ComplexArray extract(chunkSamples);
		ComplexArray speakerSpectrum(chunkSamples), micSpectrum(chunkSamples);

		size_t sharedLength = std::min(speaker.size(), mic.size());
		RealArray window = getWindow(chunkSamples, chunkStep);
		signalsmith::FFT<double> fft(chunkSamples);
		ComplexArray output(sharedLength);

		RealArray subtractionCross(chunkSamples);
		RealArray subtractionEnergy(chunkSamples);
		subtractionCross.fill(0);
		subtractionEnergy.fill(0);

		output.fill(0);
		for (size_t position = 0; position + chunkSamples < sharedLength; position += chunkStep) {
			extract = speaker.slice(position, chunkSamples, 1)*window;
			fft.fft(&extract[0], &speakerSpectrum[0]);
			
			extract = mic.slice(position, chunkSamples, 1)*window;
			fft.fft(&extract[0], &micSpectrum[0]);

			for (size_t i = 1; i < chunkSamples/2; ++i) {
				size_t i2 = chunkSamples - i;
				double refEnergy = norm(speakerSpectrum[i]) + norm(speakerSpectrum[i2]);
				
				double micEnergy = norm(micSpectrum[i]) + norm(micSpectrum[i2]);
				subtractionCross[i] += micEnergy*refEnergy;
				subtractionEnergy[i] += refEnergy*refEnergy;

				double energyFactor = subtractionCross[i]/subtractionEnergy[i];
				double subtractedEnergy = micEnergy - strength*energyFactor*refEnergy;
				double ampFactor = sqrt(std::max(0.0, subtractedEnergy)/micEnergy);
				micSpectrum[i] *= ampFactor;
				micSpectrum[i2] *= ampFactor;
			}

			fft.ifft(&micSpectrum[0], &extract[0]);
			extract /= (double)chunkSamples;

			output.slice(position, chunkSamples, 1) += extract*window;
		}
		for (size_t i = 0; i < output.size(); ++i) {
			mic[i] = output[i].real();
		}
	}
};