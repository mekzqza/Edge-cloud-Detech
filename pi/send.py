#!/usr/bin/env python3
# ส่งรูป + ข้อความจาก Raspberry Pi ไปเว็บแอป
# ติดตั้งครั้งเดียว:  pip install requests
import base64
from datetime import datetime, timezone

import requests

URL = "https://edge-cloud-detech.sukpat.dev/api/detections"


def send(image_path, plate, province, confidence):
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    res = requests.post(URL, json={
        "image": img_b64,
        "plate": plate,            # เลขทะเบียน
        "province": province,      # จังหวัด
        "confidence": confidence,  # ความแม่นยำ 0..1
        # เวลาที่ถ่าย/ส่ง — ISO8601 พร้อม timezone
        "captured_at": datetime.now(timezone.utc).isoformat(),
    })
    print(res.status_code, res.json())


if __name__ == "__main__":
    # ถ่ายรูปก่อนด้วย:  libcamera-jpeg -o photo.jpg
    send("photo.jpg", "1กข 1234", "กรุงเทพมหานคร", 0.97)
