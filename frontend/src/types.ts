// โครงข้อมูล 1 รายการตรวจจับ ที่ backend ส่งกลับมา
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
