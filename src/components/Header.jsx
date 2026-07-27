import { LogOut, User, Shield, Users } from 'lucide-react';

const roleIcons = { admin: Shield, manager: Users, employee: User };

export default function Header({ user, onLogout }) {
  const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Manager' : 'Employee';
  const RoleIcon = roleIcons[user.role] || User;

  return (
    <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
            <span className="text-xs font-bold text-amber-600">DI</span>
          </div>
          <h1 className="text-sm font-semibold text-gray-900 tracking-tight">
            DoneIt
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-gray-400 hidden sm:block">
            Task Portal
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
              <RoleIcon className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <span className="text-gray-700 hidden sm:block">{user.name}</span>
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
              {roleLabel}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
