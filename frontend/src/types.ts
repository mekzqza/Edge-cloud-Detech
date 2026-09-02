// โครงข้อมูล 1 รายการตรวจจับ ที่ backend ส่งกลับมา

export type Status = "pending" | "approved" | "revoked";

export type Detection = {
  id: number;
  filename: string;
  label: string | null;
  created_at: string;
  plate: string | null; // ค่าที่ระบบเชื่อ — จับคู่รถได้ = ป้ายที่ลงทะเบียนไว้ ไม่ได้ = เท่ากับ plate_raw
  province: string | null;
  // 4 ฟิลด์ล่างเป็นค่าดิบของ pipeline — backend ส่งมาให้เฉพาะ admin
  // ไม่ใช่ admin = ไม่มี key นี้เลย (undefined) เช็ค != null ที่เดียวก็ครอบทั้งสองกรณี
  plate_raw?: string | null; // ค่าที่ OCR อ่านมาจริง ๆ (แถวเก่าก่อนมีคอลัมน์นี้เป็น null)
  confidence?: number | null; // YOLO det conf ของกล่องป้าย
  plate_confidence?: number | null; // OCR conf ของเลขทะเบียน
  province_confidence?: number | null; // fuzzy match conf ของจังหวัด
  verified: boolean | null;
  access_granted: boolean; // ตรงกับ vehicles ที่ approved ไหม — คิดตอนบันทึก ไม่คำนวณใหม่
  direction: "in" | "out" | "unknown";
};

export type Vehicle = {
  id: number;
  plate: string;
  province: string;
  owner_id: number | null; // -> users.id (NULL = ยังไม่รู้เจ้าของ)
  status: Status;
  created_at: string;
};

// แถวจาก /api/admin/vehicles — join ชื่อเจ้าของมาให้แล้ว
export type AdminVehicle = Vehicle & {
  owner_name: string | null; // null = import มาโดยยังไม่รู้เจ้าของ
  owner_contact: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
};

// แถวจาก /api/notifications — join detections มาให้แล้ว, read_at = null คือยังไม่อ่าน
export type Notification = {
  id: number;
  reason: string;
  created_at: string;
  read_at: string | null;
  detection_id: number;
  filename: string;
  plate: string | null;
  province: string | null;
  direction: Detection["direction"];
};

// แถวจาก /api/admin/owners — id คือ users.id, username = null คือเจ้าของที่ยังล็อกอินไม่ได้
export type AdminOwner = {
  id: number;
  full_name: string;
  contact: string | null;
  username: string | null;
  vehicle_count: number;
};
