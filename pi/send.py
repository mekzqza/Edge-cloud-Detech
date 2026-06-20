#!/usr/bin/env python3
# ส่งรูป + ข้อความจาก Raspberry Pi ไปเว็บแอป
# ติดตั้งครั้งเดียว:  pip install requests
import base64
import requests

URL = "http://edge-cloud-detech.sukpat.dev/api/detections"


def send(image_path, label):
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    res = requests.post(URL, json={"image": img_b64, "label": label})
    print(res.status_code, res.json())


if __name__ == "__main__":
    # ถ่ายรูปก่อนด้วย:  libcamera-jpeg -o photo.jpg
    send("photo.jpg", "พบวัตถุ")
