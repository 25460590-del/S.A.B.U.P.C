export function ScannerSkeleton() {
  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full animate-pulse" aria-busy="true">
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2 w-2/3">
            <div className="h-3 w-32 bg-[#E2E8F0] rounded" />
            <div className="h-6 w-48 bg-[#E2E8F0] rounded" />
          </div>
          <div className="h-7 w-24 bg-[#E2E8F0] rounded-lg" />
        </div>
        <div className="h-4 w-full bg-[#E2E8F0] rounded" />
        <div className="h-14 w-full bg-[#E2E8F0] rounded-lg" />
        <div className="h-12 w-full bg-[#F1F5F9] rounded-lg" />
      </div>

      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div className="h-5 w-44 bg-[#E2E8F0] rounded" />
          <div className="h-6 w-24 bg-[#E2E8F0] rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 bg-[#F1F5F9] rounded-lg" />
          <div className="h-10 bg-[#F1F5F9] rounded-lg" />
          <div className="col-span-2 h-11 bg-[#F1F5F9] rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function MyQrSkeleton() {
  return (
    <div className="max-w-md mx-auto w-full animate-pulse" aria-busy="true">
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="bg-[#E2E8F0] h-24 w-full" />
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="w-full h-14 bg-[#F1F5F9] rounded-lg" />
          <div className="w-52 h-52 bg-[#E2E8F0] rounded-xl" />
          <div className="h-4 w-3/4 bg-[#E2E8F0] rounded" />
          <div className="h-12 w-full bg-[#E2E8F0] rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function HistorySkeleton() {
  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-5 animate-pulse" aria-busy="true">
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full bg-[#E2E8F0]" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-44 bg-[#E2E8F0] rounded" />
            <div className="h-4 w-56 bg-[#F1F5F9] rounded" />
          </div>
        </div>
        <div className="h-20 w-full bg-[#E2E8F0] rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-14 bg-[#F1F5F9] rounded-lg" />
          <div className="h-14 bg-[#F1F5F9] rounded-lg" />
          <div className="h-14 bg-[#F1F5F9] rounded-lg" />
        </div>
      </div>
      {[1, 2, 3].map((n) => (
        <div key={n} className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 flex flex-col gap-2.5">
          <div className="flex justify-between">
            <div className="h-5 w-28 bg-[#E2E8F0] rounded-full" />
            <div className="h-5 w-16 bg-[#F1F5F9] rounded" />
          </div>
          <div className="h-5 w-52 bg-[#E2E8F0] rounded" />
          <div className="h-4 w-full bg-[#F1F5F9] rounded" />
        </div>
      ))}
    </div>
  )
}

export function CommandCenterSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-3">
            <div className="h-4 w-28 bg-[#E2E8F0] rounded" />
            <div className="h-9 w-20 bg-[#E2E8F0] rounded" />
            <div className="h-3.5 w-36 bg-[#F1F5F9] rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-4">
            <div className="flex justify-between">
              <div className="h-5 w-28 bg-[#E2E8F0] rounded-full" />
              <div className="h-5 w-20 bg-[#F1F5F9] rounded" />
            </div>
            <div className="h-6 w-48 bg-[#E2E8F0] rounded" />
            <div className="h-4 w-full bg-[#F1F5F9] rounded" />
            <div className="pt-3 border-t border-[#E2E8F0] flex justify-between">
              <div className="h-6 w-20 bg-[#F1F5F9] rounded-full" />
              <div className="h-9 w-28 bg-[#E2E8F0] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LogbookSkeleton() {
  return (
    <div className="flex flex-col gap-5 animate-pulse" aria-busy="true">
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 h-11 bg-[#F1F5F9] rounded-lg" />
        <div className="h-11 bg-[#F1F5F9] rounded-lg" />
        <div className="h-11 bg-[#F1F5F9] rounded-lg" />
        <div className="h-11 bg-[#F1F5F9] rounded-lg" />
      </div>
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="h-11 bg-[#F8FAFC] border-b border-[#E2E8F0]" />
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="px-4 py-3.5 border-b border-[#E2E8F0] grid grid-cols-6 gap-4">
            <div className="h-4 bg-[#E2E8F0] rounded" />
            <div className="h-4 bg-[#F1F5F9] rounded" />
            <div className="h-4 bg-[#E2E8F0] rounded" />
            <div className="h-4 bg-[#F1F5F9] rounded" />
            <div className="h-4 bg-[#E2E8F0] rounded" />
            <div className="h-4 bg-[#F1F5F9] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
