import importlib.util
import unittest
from pathlib import Path
import numpy as np
spec = importlib.util.spec_from_file_location('layer_audio', Path(__file__).parents[1] / 'YueHaiAssistant/python/layer_audio.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LayerAudioTests(unittest.TestCase):
    def test_trim_and_stretch_preserve_composition_duration(self):
        audio = np.arange(100, dtype=np.float32)
        output = module.select_layer_audio(audio, dict(sourceIn=2, sourceOut=6, stretch=125), rate=10)
        self.assertEqual(len(output), 50)
        self.assertEqual(output[0], 20)
        self.assertAlmostEqual(float(output[10]), 28)

    def test_audio_ending_before_video_is_padded_without_shifting_speech(self):
        output = module.select_layer_audio(np.ones(40, dtype=np.float32), dict(sourceIn=2, sourceOut=6, stretch=100), rate=10)
        np.testing.assert_array_equal(output[:20], np.ones(20))
        np.testing.assert_array_equal(output[20:], np.zeros(20))

if __name__ == '__main__': unittest.main()
