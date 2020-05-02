#include <napi.h>


void log(const Napi::Env env, const std::vector<std::string> msgs) {
    auto lg = env.Global().Get("console").As<Napi::Object>().Get("log").As<Napi::Function>();
    auto ags = std::vector<napi_value>();
    for(auto s: msgs) {
      ags.push_back(Napi::String::New(env, s));
    }
    lg.Call(ags);
}

void i420overlay(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    auto src = info[0].As<Napi::ArrayBuffer>();
    auto dest = info[1].As<Napi::ArrayBuffer>();

    auto srcWidth = info[2].As<Napi::Number>().Int32Value();
    auto srcHeight = info[3].As<Napi::Number>().Int32Value();

    auto left = info[4].As<Napi::Number>().Int32Value();
    auto top = info[5].As<Napi::Number>().Int32Value();
    auto width = info[6].As<Napi::Number>().Int32Value();
    auto height = info[7].As<Napi::Number>().Int32Value();

    // Require dest to be an ArrayBuffer of a 640x480 YUV420 image. https://en.wikipedia.org/wiki/YUV#Y%E2%80%B2UV420p_(and_Y%E2%80%B2V12_or_YV12)_to_RGB888_conversion

    auto srcLength = src.ByteLength();
    auto destLength = dest.ByteLength();

    uint8_t* srcData = (uint8_t*)src.Data();
    uint8_t* destData = (uint8_t*)dest.Data();

    auto fullDestOriginU = 640 * 480;
    auto fullDestOriginV = (int)(640 * 480 * 1.25);

    auto srcOriginU = srcWidth * srcHeight;
    auto srcOriginV = (int)(srcWidth * srcHeight * 1.25);

    auto resizeMultipleX = width / (double)srcWidth;
    auto resizeMultipleY = height / (double)srcHeight;

    
    // Y Plane 
    for (auto y = 0; y < height; y++) {
      for (auto x = 0; x < width; x++) {
        auto fullDestX = x + left;
        auto fullDestY = y + top;
        auto destIdx = fullDestY * 640 + fullDestX;
        auto srcX = (int)(x / resizeMultipleX);
        auto srcY = (int)(y / resizeMultipleY);
        auto srcIdx = srcY * srcWidth + srcX;

        destData[destIdx] = srcData[srcIdx];
      }
    }
    // U Plane
    for (auto y = 0; y < height/2; y++) {
      for (auto x = 0; x < width/2; x++) {
        auto fullDestX = x + left/2;
        auto fullDestY = y + top/2;
        auto destIdx = fullDestOriginU + fullDestY * 320 + fullDestX;
        auto srcX = (int)(x / resizeMultipleX);
        auto srcY = (int)(y / resizeMultipleY);
        auto srcIdx = srcOriginU + srcY * (srcWidth/2) + srcX;


        destData[destIdx] = srcData[srcIdx];
      }
    }
    // V Plane
    for (auto y = 0; y < height/2; y++) {
      for (auto x = 0; x < width/2; x++) {
        auto fullDestX = x + left/2;
        auto fullDestY = y + top/2;
        auto destIdx = fullDestOriginV + fullDestY * 320 + fullDestX;
        auto srcX = (int)(x / resizeMultipleX);
        auto srcY = (int)(y / resizeMultipleY);
        auto srcIdx = srcOriginV + srcY * (srcWidth/2) + srcX;


        destData[destIdx] = srcData[srcIdx];
      }
    }


    //log(env, {"Finished processing frame"});
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "i420overlay"), Napi::Function::New(env, i420overlay));
              
  return exports;
}

NODE_API_MODULE(video, Init);