import RecordsList from "../records/list";

// บันทึกรถออก — หน้าเดียวกับ /records แค่กรอง direction=out
export default function ExitsPage() {
  return <RecordsList direction="out" />;
}
