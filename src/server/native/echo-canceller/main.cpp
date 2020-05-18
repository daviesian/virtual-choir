#include <iostream> // std::cout
#include <string>
#include <complex>

#include "lib/wav.h"
#include "lib/numeric.h"
#include "lib/fft.h"

#include "shared/console-colours.h"
#include "shared/simple-args.h"

#include "echo-canceller.h"

using complex = std::complex<double>;
using ComplexArray = numeric::FreeArray<complex>;

ComplexArray zeroPad(const ComplexArray &array, size_t length) {
	ComplexArray result(length);
	result.fill(0);
	result = array;
	return result;
}

int main(int argc, char* argv[]) {
	SimpleArgs args(argc, argv);
	args.helpFlag("help");

	std::string speakerFile = args.arg<std::string>("speaker", "WAV file");
	std::string micFile = args.arg<std::string>("mic", "WAV file");
	std::string outputWav = args.arg<std::string>("output", "WAV file", "output.wav");
	if (args.error()) return args.help();
	std::cout << Console::Cyan << micFile << " - " << speakerFile << " -> " << outputWav << Console::Reset << "\n";

	// Load the WAVs
	Wav speaker(speakerFile);
	Wav mic(micFile);
	if (speaker.sampleRate != mic.sampleRate) {
		std::cout << Console::Red << "sample-rates don't match\n" << Console::Reset;
		return 1;
	}
	// speaker.makeMono();
	// mic.makeMono();

	// Cancel the echo (in-place)
	EchoCanceller canceller(speaker.sampleRate);
	canceller.cancel(&speaker.samples[0], speaker.samples.size(), &mic.samples[0], mic.samples.size());

	mic.write(outputWav);
}