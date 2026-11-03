import { PatientCall } from "@/components/patient-call";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PatientCall />
    </>
  );
}
