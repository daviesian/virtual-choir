#include <napi.h>

#include "echo-canceller.h"


void log(const Napi::Env env, const std::vector<std::string> msgs) {
    auto lg = env.Global().Get("console").As<Napi::Object>().Get("log").As<Napi::Function>();
    auto ags = std::vector<napi_value>();
    for(auto s: msgs) {
      ags.push_back(Napi::String::New(env, s));
    }
    lg.Call(ags);
}

Napi::Number cancel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    auto referenceAudio = info[0].As<Napi::ArrayBuffer>();
    auto recordedAudio = info[1].As<Napi::ArrayBuffer>();

    float* referenceData = (float*)referenceAudio.Data();
    float* recordedData = (float*)recordedAudio.Data();
    const size_t refLength = referenceAudio.ByteLength() / 4;
    const size_t recLength = recordedAudio.ByteLength() / 4;

    log(env, {"Cancelling", std::to_string(recLength), "samples of recorded audio"});

    EchoCanceller canceller(44100);
	auto offset = canceller.cancel(referenceData, refLength, recordedData, recLength);

    log(env, {"Got offset of", std::to_string(offset), "samples (that's", std::to_string(offset/44100.0), "ms)"});

    return Napi::Number::New(env, -offset / 44100.0); // Return the offset in seconds
}



Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "cancel"), Napi::Function::New(env, cancel));
              
  return exports;
}

NODE_API_MODULE(echoCanceller, Init);