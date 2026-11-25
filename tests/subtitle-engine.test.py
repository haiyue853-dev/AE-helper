import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('universal', Path(__file__).parents[1] / 'YueHaiAssistant/python/universal.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


class EngineTests(unittest.TestCase):
    def test_gpu_failure_retries_same_job_on_cpu_and_clears_partial_results(self):
        commands, received = [], []
        class Process:
            def __init__(self, command, **kwargs):
                commands.append(command)
                self.code = 1 if len(commands) == 1 else 0
                self.stdout = io.StringIO(json.dumps({'type': 'segment', 'text': 'GPU partial' if self.code else 'CPU final'}) + '\n')
            def wait(self, **kwargs): return self.code
            def poll(self): return self.code
        with tempfile.TemporaryDirectory() as directory:
            config = dict(directory=directory, nativeEngine='engine.exe', nativeModel='same-model.bin', device='auto')
            self.assertTrue(engine.run_engine(config, received.append, received.clear, lambda: False, Process))
            self.assertEqual(received, [{'type': 'segment', 'text': 'CPU final'}])
            self.assertEqual(commands[0], commands[1][:-1])
            self.assertEqual(commands[1][-1], '--cpu')

    def test_forced_cpu_does_not_attempt_gpu(self):
        commands = []
        class Process:
            def __init__(self, command, **kwargs):
                commands.append(command)
                self.stdout = io.StringIO('')
            def wait(self, **kwargs): return 0
            def poll(self): return 0
        with tempfile.TemporaryDirectory() as directory:
            engine.run_engine(dict(directory=directory, nativeEngine='engine.exe', device='cpu'), lambda e: None,
                              lambda: self.fail('Unexpected retry'), lambda: False, Process)
        self.assertEqual(len(commands), 1)
        self.assertEqual(commands[0][-1], '--cpu')


if __name__ == '__main__': unittest.main()
