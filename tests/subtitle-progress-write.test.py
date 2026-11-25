import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('subtitle_transcribe', Path(__file__).parents[1] / 'YueHaiAssistant/python/transcribe.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProgressWriteTests(unittest.TestCase):
    def test_temporary_windows_file_lock_keeps_old_progress_then_replaces_it(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'progress.json'
            target.write_text('{"state":"running"}', encoding='utf-8')
            original = Path.replace
            calls = []

            def locked_then_available(temporary, destination):
                calls.append(destination)
                if len(calls) < 3:
                    self.assertEqual(json.loads(target.read_text(encoding='utf-8')), {'state': 'running'})
                    raise PermissionError(5, 'Access is denied')
                return original(temporary, destination)

            with patch.object(Path, 'replace', locked_then_available), patch.object(module.time, 'sleep') as wait:
                module.write_json(target, {'state': 'done', 'message': '中文完成'})
            self.assertEqual(json.loads(target.read_text(encoding='utf-8')), {'state': 'done', 'message': '中文完成'})
            self.assertEqual(len(calls), 3)
            self.assertEqual(wait.call_count, 2)

    def test_persistent_denial_is_reported_without_overwriting_the_old_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'progress.json'
            target.write_text('{"state":"running"}', encoding='utf-8')
            with patch.object(Path, 'replace', side_effect=PermissionError(5, 'denied')) as replace, patch.object(module.time, 'sleep'):
                with self.assertRaises(PermissionError):
                    module.write_json(target, {'state': 'done'})
            self.assertGreater(replace.call_count, 1)
            self.assertLessEqual(replace.call_count, 8)
            self.assertEqual(json.loads(target.read_text(encoding='utf-8')), {'state': 'running'})

    def test_other_filesystem_errors_are_not_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(Path, 'replace', side_effect=OSError('disk full')) as replace, patch.object(module.time, 'sleep') as wait:
                with self.assertRaises(OSError):
                    module.write_json(Path(directory) / 'progress.json', {'state': 'done'})
            self.assertEqual(replace.call_count, 1)
            wait.assert_not_called()


if __name__ == '__main__':
    unittest.main()
