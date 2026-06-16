export default function DashboardSkeleton() {
  return (
    <div className="mx-8 my-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="h-3 w-24 bg-gray-600 rounded mb-3" />
          <div className="h-8 w-56 bg-gray-600 rounded" />
        </div>

        <div className="flex gap-3">
          <div className="h-11 w-40 bg-gray-600 rounded-xl" />
          <div className="h-11 w-32 bg-gray-600 rounded-xl" />
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-4xl mt-22 center mx-auto">
        <div className="grid grid-cols-3 gap-4 mb-6 ">
            {[1, 2, 3].map((item) => (
            <div
                key={item}
                className="h-24 bg-gray-800 border border-gray-600 rounded-2xl p-4"
            >
                <div className="h-3 w-20 bg-gray-600 rounded mb-3" />
                <div className="h-8 w-10 bg-gray-600 rounded" />
            </div>
            ))}
        </div>

        {/* Search */}
        <div className="h-12 bg-gray-800 border border-gray-600 rounded-xl mb-6" />

        {/* Group Cards */}
        {[1, 2].map((card) => (
            <div
            key={card}
            className="bg-gray-800 border border-gray-600 rounded-3xl p-5 mb-4"
            >
            {/* Top Row */}
            <div className="flex justify-between mb-5">
                <div>
                <div className="h-6 w-48 bg-gray-600 rounded mb-3" />

                <div className="flex gap-2">
                    <div className="h-6 w-20 bg-gray-600 rounded-full" />
                    <div className="h-6 w-24 bg-gray-600 rounded-full" />
                    <div className="h-6 w-14 bg-gray-600 rounded-full" />
                </div>
                </div>

                <div className="text-right">
                <div className="h-3 w-14 bg-gray-600 rounded mb-2 ml-auto" />
                <div className="h-8 w-24 bg-gray-600 rounded ml-auto" />
                </div>
            </div>

            {/* Wallet */}
            <div className="h-3 w-32 bg-gray-600 rounded mb-3" />

            <div className="w-full h-2 bg-gray-600 rounded-full mb-5" />

            {/* Footer */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((avatar) => (
                    <div
                        key={avatar}
                        className="w-8 h-8 rounded-full bg-gray-600 border border-gray-800"
                    />
                    ))}
                </div>

                <div className="h-4 w-24 bg-gray-600 rounded" />
                </div>

                <div className="h-10 w-32 bg-gray-600 rounded-xl" />
            </div>
            </div>
        ))}
      </div>
    </div>
  );
}