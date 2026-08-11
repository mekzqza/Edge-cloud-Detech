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
};

export type Vehicle = {
  id: number;
  plate: string;
  province: string;
  owner_id: number;
  status: Status;
  created_at: string;
};
