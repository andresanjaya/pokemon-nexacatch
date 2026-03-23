interface PokedexHeaderProps {
  title?: string;
  leftButton?: React.ReactNode;
  rightButton?: React.ReactNode;
}

export function PokedexHeader({ title, leftButton, rightButton }: PokedexHeaderProps) {
  return (
    <div className="bg-gradient-to-b from-red-600 to-red-700 px-4 pt-4 pb-2 rounded-b-3xl shadow-xl relative">
      {/* Top section with circle and dots OR custom buttons */}
      <div className="flex items-center justify-between mb-6">
        {/* Left - Big Circle or Custom Button */}
        {leftButton ? (
          leftButton
        ) : (
          <div className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center border-4 border-gray-800">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 shadow-inner"></div>
          </div>
        )}
        
        {/* Right - Three dots or Custom Button */}
        {rightButton ? (
          rightButton
        ) : (
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-red-900"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-yellow-600"></div>
            <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-green-600"></div>
          </div>
        )}
      </div>
      
      
    </div>
  );
}