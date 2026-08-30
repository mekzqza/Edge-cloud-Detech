#!/usr/bin/env python3
# ส่งรูป + ข้อความจาก Raspberry Pi ไปเว็บแอป
# ติดตั้งครั้งเดียว:  pip install requests
import base64
from datetime import datetime, timezone

import requests

URL = "https://edge-cloud-detech.sukpat.dev/api/detections"
CAMERA = "IN"   # กล้องตัวนี้เป็นขาเข้าหรือขาออก: "IN" / "OUT" (ไม่ส่ง = unknown)


def send(image_path, plate, province, confidence, plate_conf=None, prov_conf=None):
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    res = requests.post(URL, json={
        "image": img_b64,
        "plate": plate,            # เลขทะเบียน
        "province": province,      # จังหวัด
        "confidence": confidence,  # YOLO det conf ของกล่องป้าย 0..1
        "plate_confidence": plate_conf,  # OCR conf ของแถวบน (ส่ง None ได้)
        "province_confidence": prov_conf,  # fuzzy match conf ของแถวล่าง (ส่ง None ได้)
        "camera": CAMERA,          # ทิศทาง เข้า/ออก
        # เวลาที่ถ่าย/ส่ง — ISO8601 พร้อม timezone
        "captured_at": datetime.now(timezone.utc).isoformat(),
    })
    print(res.status_code, res.json())


if __name__ == "__main__":
    # ถ่ายรูปก่อนด้วย:  libcamera-jpeg -o photo.jpg
    send("photo.jpg", "1กข 1234", "กรุงเทพมหานคร", 0.97, 0.91, 0.88)
