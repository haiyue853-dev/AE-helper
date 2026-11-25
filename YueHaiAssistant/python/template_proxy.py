"""Create a local, silent viewing proxy. AE always receives the original file."""
import sys
from fractions import Fraction
import av

source, target = sys.argv[1:3]
with av.open(source) as incoming, av.open(target, 'w', options={'movflags': '+faststart'}) as outgoing:
    original = incoming.streams.video[0]
    scale = min(1, 640 / max(original.width, original.height))
    width = max(2, round(original.width * scale / 2) * 2)
    height = max(2, round(original.height * scale / 2) * 2)
    rate = original.average_rate or Fraction(25, 1)
    stream = outgoing.add_stream('libx264', rate=rate, options={'preset': 'ultrafast', 'crf': '28'})
    stream.width, stream.height, stream.pix_fmt = width, height, 'yuv420p'
    stream.codec_context.thread_count = 2
    stream.time_base = Fraction(1, 90000)
    start = None
    for index, frame in enumerate(incoming.decode(original)):
        moment = frame.time if frame.time is not None else index / float(rate)
        if start is None:
            start = moment
        converted = frame.reformat(width=width, height=height, format='yuv420p')
        converted.pts = round((moment - start) * 90000)
        converted.time_base = stream.time_base
        for packet in stream.encode(converted):
            outgoing.mux(packet)
        if index % 100 == 0:
            print('正在生成兼容预览：%.1f 秒（预览无音频，替换使用原文件）' % (moment - start), flush=True)
    for packet in stream.encode():
        outgoing.mux(packet)
