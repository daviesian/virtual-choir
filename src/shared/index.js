import Peer from "simple-peer";

Peer.prototype.getTransceiver = function(id) {
    return this._pc.getTransceivers()[RTCTransceivers.indexOf(id)];
}

export const RTCTransceivers = [
    'my-video',
    'my-audio',

    'conductor-video',
    'conductor-audio',

    'choir-video',

    'speaker-video',
    'speaker-audio',
];

RTCTransceivers.MY_VIDEO = 'my-video';
RTCTransceivers.MY_AUDIO = 'my-audio';

RTCTransceivers.CONDUCTOR_VIDEO = 'conductor-video';
RTCTransceivers.CONDUCTOR_AUDIO = 'conductor-audio';

RTCTransceivers.CHOIR_VIDEO = 'choir-video';

RTCTransceivers.SPEAKER_VIDEO = 'speaker-video';
RTCTransceivers.SPEAKER_AUDIO = 'speaker-audio';
