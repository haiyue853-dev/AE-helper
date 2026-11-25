import json
import os
import sys
import time
import traceback
import wave
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'


def write_json(file, value):
    file = Path(file)
    temporary = file.with_suffix(file.suffix + '.tmp')
    payload = json.dumps(value, ensure_ascii=False)
    for attempt in range(6):
        try:
            temporary.write_text(payload, encoding='utf-8')
            temporary.replace(file)
            return
        except PermissionError:
            # Windows readers/scanners can briefly hold the destination open.
            if attempt == 5:
                raise
            time.sleep(.05 * (attempt + 1))


def run(config):
    directory = Path(config['directory'])
    segments = []
    language = config.get('language', 'auto')
    duration = 0

    def progress(state, message, percent=0):
        write_json(directory / 'progress.json', dict(state=state, message=message, percent=percent, count=len(segments)))

    def transcript():
        write_json(directory / 'recognition.json', dict(language=language, duration=duration, segments=segments))

    def stopped():
        if (directory / 'STOP').exists():
            transcript()
            progress('cancelled', '已停止，保留已识别的字幕。')
            return True
        return False

    try:
        progress('running', '正在读取视频音轨…')
        import numpy as np
        from faster_whisper import WhisperModel
        from faster_whisper.audio import decode_audio

        try:
            audio = decode_audio(config['video'], sampling_rate=16000)
        except (IndexError, StopIteration):
            raise ValueError('这个文件没有可读取的音轨，请选择有人声的视频或音频。')
        from layer_audio import select_layer_audio
        audio = select_layer_audio(audio, config.get('sourceLayer'))
        duration = len(audio) / 16000
        if not len(audio) or float(np.max(np.abs(audio))) < 0.0001:
            raise ValueError('音轨为空或静音，没有可识别的人声。')
        with wave.open(str(directory / '识别音轨.wav'), 'wb') as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(16000)
            output.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())
        if stopped():
            return
        progress('running', '正在加载本地语音模型…', 3)
        if config.get('nativeEngine'):
            from faster_whisper.vad import get_speech_timestamps, VadOptions
            from universal import run_engine
            speech = get_speech_timestamps(audio, VadOptions(threshold=.35, min_silence_duration_ms=500))
            if not speech:
                transcript()
                progress('empty', '未检测到人声，请检查音轨或更换音频。', 100)
                return

            backend = '正在加载模型'

            def event_received(event):
                nonlocal backend, language
                if event.get('type') == 'runtime':
                    backend = 'Vulkan 后端' if event.get('device') == 'Vulkan' else 'CPU 后端'
                    progress('running', backend + ' · 正在识别人声…', 5)
                elif event.get('type') == 'segment':
                    start, end = max(0, float(event['start'])), min(duration, float(event['end']))
                    if end <= start or not event.get('text', '').strip():
                        return
                    if not any(start < s['end'] / 16000 and end > s['start'] / 16000 for s in speech):
                        return
                    segments.append(dict(start=start, end=end, text=event['text'], words=event.get('words', [])))
                    language = event.get('language') or language
                    transcript()
                    progress('running', backend + ' · 正在识别人声…', min(98, 5 + 93 * end / max(duration, 1)))

            def retry_cpu():
                segments.clear()
                transcript()
                progress('running', '自动加速未能完成，正在以同一模型重试 CPU…', 3)

            if not run_engine(config, event_received, retry_cpu, stopped):
                return
            transcript()
            progress('done' if segments else 'empty',
                     backend + ' · 识别完成，可校对文字、导出 SRT 或放入 AE。' if segments else '未识别到人声，请检查音轨或更换识别语言。', 100)
            return
        model = WhisperModel(config['model'], device='cpu', compute_type='int8',
                             cpu_threads=min(8, os.cpu_count() or 4), local_files_only=True)
        if stopped():
            return
        progress('running', '正在识别人声并对齐时间…', 5)
        stream, info = model.transcribe(audio, language=None if language == 'auto' else language,
                                       beam_size=5, word_timestamps=True, vad_filter=True,
                                       vad_parameters=dict(min_silence_duration_ms=500),
                                       condition_on_previous_text=False,
                                       initial_prompt='以下是简体中文语音字幕。' if language == 'zh' else None)
        language = info.language
        for segment in stream:
            if stopped():
                return
            if not segment.text.strip():
                continue
            segments.append(dict(start=segment.start, end=segment.end, text=segment.text,
                                 words=[dict(start=w.start, end=w.end, word=w.word) for w in segment.words or []]))
            transcript()
            progress('running', '正在识别人声…', min(98, 5 + 93 * segment.end / max(duration, 1)))
        transcript()
        if not segments:
            progress('empty', '未识别到人声，请检查音轨或更换识别语言。', 100)
        else:
            progress('done', '识别完成，可校对文字、导出 SRT 或放入 AE。', 100)
    except Exception as error:
        transcript()
        (directory / 'error.log').write_text(traceback.format_exc(), encoding='utf-8')
        progress('failed', str(error))


if __name__ == '__main__':
    run(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig')))
