import { X, Video, CameraOff, Clock } from 'lucide-react';

export default function StandupModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-lg max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-200">
              <Video className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">Daily Standup</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4 mb-5 text-xs text-gray-600">
          <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 border border-slate-200/50 rounded-lg">
            <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800">Time Window</p>
              <p>Link will be valid for every day 10 AM to 10:30 AM</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 border border-slate-200/50 rounded-lg">
            <CameraOff className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800">Camera Policy</p>
              <p>Have you need to turn on the camera? No one will be behind the camera</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-primary text-xs py-2 flex-1">
            Cancel
          </button>
          <a
            href="https://meet.google.com/qdr-ywqo-gbr"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="btn-amber text-xs py-2 flex-1 text-center font-medium block"
          >
            Join Meeting
          </a>
        </div>
      </div>
    </div>
  );
}
