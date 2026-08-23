// โครงข้อมูล 1 รายการตรวจจับ ที่ backend ส่งกลับมา

export type Status = "pending" | "approved" | "revoked";

export type Detection = {
  id: number;
  filename: string;
  label: string | null;
  created_at: string;
  plate: string | null;
  province: string | null;
  confidence: number | null;
  verified: boolean | null;
  access_granted: boolean; // ตรงกับ vehicles ที่ approved ไหม — คิดตอนบันทึก ไม่คำนวณใหม่
  direction: "in" | "out" | "unknown";
};

export type Vehicle = {
  id: number;
  plate: string;
  province: string;
  owner_id: number;
  status: Status;
  created_at: string;
};

// แถวจาก /api/admin/vehicles — join ชื่อผู้ใช้มาให้แล้ว
export type AdminVehicle = Vehicle & {
  owner_name: string;
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
