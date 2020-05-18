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

    log(env, {"Cancel"});

    return Napi::Number::New(env, 42); // Return the offset in seconds
}



Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "cancel"), Napi::Function::New(env, cancel));
              
  return exports;
}

NODE_API_MODULE(echoCanceller, Init);