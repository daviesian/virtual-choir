{
  "targets": [
    {
      "target_name": "video",
      "sources": [ "src/server/native/addon/video.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
    }
  ]
}