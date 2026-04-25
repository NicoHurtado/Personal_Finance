import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <main className="md:ml-[220px] min-h-screen transition-all duration-150 main-mobile-safe">
        <div className="px-4 py-6 md:px-8 md:py-10">
          {children}
        </div>
      </main>
    </>
  );
}
