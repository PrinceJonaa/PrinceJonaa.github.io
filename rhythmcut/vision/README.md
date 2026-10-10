# Local face cues

`blaze_face_short_range.tflite` is Google's MediaPipe short-range face detector,
downloaded from the version-1 model URL used by Google's web example:
https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite

The pinned `@mediapipe/tasks-vision` dependency supplies the runtime. The build
copies its module WASM loader and binary into `vision/wasm/`; these generated
runtime files are not checked into source. Model and runtime are served from
the application's own origin. Imported frames never go to a provider.

The detector measures face presence and bounding-box geometry. It does not
identify the performer, measure occlusion, eye closure or lip synchronization.
Sparse samples can miss distant faces, profiles and brief events. Missing cues
do not disqualify a take. The runtime adds about 13 MB on first analysis, so it
is loaded in a worker only when a take is analyzed, not during app startup.
