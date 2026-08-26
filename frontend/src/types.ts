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
  owner_id: number | null; // -> owners.id (NULL = ยังไม่รู้เจ้าของ)
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
