"""Isolated native inference: a failed GPU process can safely retry on CPU."""
import json
import queue
import subprocess
import threading
from pathlib import Path


def run_engine(config, on_event, on_retry, stopped, popen=subprocess.Popen):
    directory = Path(config['directory'])
    attempts = [True] if config.get('device') == 'cpu' else [False, True]
    for attempt, cpu in enumerate(attempts):
        if stopped():
            return False
        if attempt:
            on_retry()
        command = [config['nativeEngine'], str(directory / 'job.json')]
        if cpu:
            command.append('--cpu')
        with (directory / 'engine.log').open('a', encoding='utf-8') as log:
            log.write('\nBackend: ' + ('CPU' if cpu else 'auto') + '\n')
            log.flush()
            process = popen(command, stdout=subprocess.PIPE, stderr=log,
                            encoding='utf-8', errors='replace',
                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            events = queue.Queue()

            def read_lines():
                try:
                    for line in process.stdout:
                        events.put(line)
                finally:
                    events.put(None)

            reader = threading.Thread(target=read_lines, daemon=True)
            reader.start()
            try:
                while True:
                    if stopped():
                        process.terminate()
                        return False
                    try:
                        line = events.get(timeout=.2)
                    except queue.Empty:
                        continue
                    if line is None:
                        break
                    try:
                        event = json.loads(line)
                    except (ValueError, TypeError):
                        continue
                    on_event(event)
                if process.wait() == 0:
                    return True
            finally:
                if process.poll() is None:
                    process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                reader.join(timeout=1)
                process.stdout.close()
    raise RuntimeError('本地识别引擎运行失败，请查看任务目录里的 engine.log。')
