from __future__ import annotations

from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
import soundfile as sf

SOURCE_URL = "https://upload.wikimedia.org/wikipedia/commons/6/65/Tabla_drums_demo.oga"
ROOT = Path(__file__).resolve().parents[1]
TMP_DIR = ROOT / ".tmp"
OUTPUT_DIR = ROOT / "public" / "audio" / "tabla"
SOURCE_FILE = TMP_DIR / "tabla-demo.oga"

SAMPLES = {
    "bayan-ge.wav": {"start": 106.84, "duration": 0.78, "fade_out": 0.18},
    "dayan-open.wav": {"start": 119.20, "duration": 0.72, "fade_out": 0.16},
    "dayan-bright.wav": {"start": 24.55, "duration": 0.68, "fade_out": 0.14},
    "dayan-muted.wav": {"start": 69.18, "duration": 0.34, "fade_out": 0.08},
}


def apply_fade(segment: np.ndarray, sample_rate: int, fade_in: float, fade_out: float) -> np.ndarray:
    fade_in_samples = min(int(sample_rate * fade_in), len(segment) // 2)
    fade_out_samples = min(int(sample_rate * fade_out), len(segment) // 2)

    if fade_in_samples > 1:
        segment[:fade_in_samples] *= np.linspace(0.0, 1.0, fade_in_samples)

    if fade_out_samples > 1:
        segment[-fade_out_samples:] *= np.linspace(1.0, 0.0, fade_out_samples)

    return segment


def download_source(destination: Path) -> None:
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "SurSaath/1.0 (+https://github.com/rishavpunatar/Taal-Box)"
        },
    )

    with urlopen(request) as response:
        destination.write_bytes(response.read())


def main() -> None:
    TMP_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not SOURCE_FILE.exists():
        download_source(SOURCE_FILE)

    audio, sample_rate = sf.read(SOURCE_FILE)
    mono = audio.mean(axis=1).astype(np.float32)

    for file_name, config in SAMPLES.items():
        start_frame = int(config["start"] * sample_rate)
        end_frame = start_frame + int(config["duration"] * sample_rate)
        segment = np.copy(mono[start_frame:end_frame])
        segment = apply_fade(segment, sample_rate, 0.004, config["fade_out"])
        peak = float(np.max(np.abs(segment)))

        if peak > 0:
            segment *= 0.97 / peak

        sf.write(
            OUTPUT_DIR / file_name,
            segment,
            sample_rate,
            subtype="PCM_16",
        )


if __name__ == "__main__":
    main()
