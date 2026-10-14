import os
import unittest
import numpy as np
import torch

from .model import MODEL_INPUT_CHANNELS, MODEL_INPUT_SIZE, MODEL_ARCHITECTURE, load_checkpoint_state_dict
from .inference import checkpoint_self_test, run_sar_segmentation


class ModelIntegrationTests(unittest.TestCase):
    def test_checkpoint_loads_exactly(self):
        model, checksum = load_checkpoint_state_dict(
            os.path.join(os.path.dirname(__file__), "weights", "unet_oilspill.pth")
        )
        self.assertTrue(checksum)
        self.assertEqual(MODEL_INPUT_CHANNELS, 3)
        self.assertEqual(MODEL_ARCHITECTURE, "U-Net with ResNet-34 encoder")
        self.assertEqual(model(torch.zeros(1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)).shape, (1, 1, 256, 256))

    def test_self_test_passes(self):
        result = checkpoint_self_test()
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["inputShape"], [1, 3, 256, 256])
        self.assertEqual(result["outputShape"], [1, 1, 256, 256])

    def test_synthetic_input_is_disabled(self):
        with self.assertRaises(ValueError):
            run_sar_segmentation(
                sar_image_bytes=None,
                bbox=(20, 60, 21, 61),
                scene_id="TEST",
            )

    def test_negative_clean_ocean_sample(self):
        # A uniform radar backscatter sea surface without dark slick anomalies
        clean_sea = np.full((3, 256, 256), 0.65, dtype=np.float32)
        res = run_sar_segmentation(
            bbox=(21.0, 68.0, 22.0, 69.0),
            scene_id="TEST_CLEAN_OCEAN",
            channels=clean_sea,
            allow_unverified=True,
        )
        self.assertEqual(res["status"], "SUCCESS")
        self.assertFalse(res["spillDetected"])
        self.assertEqual(res["classification"], "NO OIL SPILL DETECTED")
        self.assertEqual(res["segmentation"]["areaKm2"], 0.0)
        self.assertIsNone(res["segmentation"]["polygonGeoJson"])
        self.assertGreater(res["modelMetadata"]["cleanOceanConfidencePercent"], 90.0)
        self.assertIn("diagnostics", res["modelMetadata"])
        self.assertIn("inputStatistics", res["modelMetadata"]["diagnostics"])

    def test_positive_slick_sample_and_area(self):
        # Standardized dark anomaly simulating an oil slick (capillary damping)
        from .inference import get_or_load_model, mask_to_contour_polygon
        model, _ = get_or_load_model()
        mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)

        slick_img = np.full((3, 256, 256), 0.7, dtype=np.float32)
        slick_img[:, 100:150, 100:150] = 0.05
        tensor = torch.from_numpy(slick_img).unsqueeze(0)
        tensor_norm = (tensor - mean) / std

        with torch.inference_mode():
            prob = torch.sigmoid(model(tensor_norm))[0, 0].cpu().numpy()

        binary = prob >= 0.5
        pos_pixels = int(np.sum(binary))
        self.assertGreater(pos_pixels, 100)

        coords = mask_to_contour_polygon(binary, (21.0, 68.0, 22.0, 69.0))
        self.assertGreaterEqual(len(coords), 4)
        # Verify closed ring
        self.assertEqual(coords[0], coords[-1])


if __name__ == "__main__":
    unittest.main()
