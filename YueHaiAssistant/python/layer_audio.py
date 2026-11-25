def select_layer_audio(audio, layer, rate=16000):
    """Keep the layer's visible source interval, in composition playback time."""
    if not layer:
        return audio
    import numpy as np
    first, last = round(layer['sourceIn'] * rate), round(layer['sourceOut'] * rate)
    if first < 0 or last <= first:
        raise ValueError('图层音频范围超出源文件，请重新读取 AE 图层。')
    interval = last - first
    audio = audio[first:min(last, len(audio))]
    if len(audio) < interval:
        audio = np.pad(audio, (0, interval - len(audio)))
    ratio = layer['stretch'] / 100
    if ratio <= 0:
        raise ValueError('暂不支持倒放图层，请先预渲染。')
    if abs(ratio - 1) > .000001 and len(audio):
        count = max(1, round(len(audio) * ratio))
        audio = np.interp(np.arange(count) / ratio, np.arange(len(audio)), audio).astype(np.float32)
    return audio
