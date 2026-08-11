// โครงข้อมูล 1 รายการตรวจจับ ที่ backend ส่งกลับมา

export type Status = "pending" | "approved";

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

export type vehicle = {
  id: number;
  plate: string;
  province: string;
  owner_id: number;
  status: string;
  created_at: string;
};
