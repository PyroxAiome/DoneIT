import { ShieldCheck, MessageSquare, X } from 'lucide-react';

export default function TaskVerificationModal({ isOpen, onClose, task }) {
  if (!isOpen || !task) return null;

  const verifierName = task.verifier_name || 'Admin';
  const verifierRole = task.verifier_role || 'Verifier';

  const whatsappMessage = `Hi ${verifierName}, I have completed the task "${task.title}" and would like to request a review meeting to verify and mark it completed.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">
                {task.verifier_name ? 'Task Verification Required' : 'Admin Verification Required'}
              </h3>
              <p className="text-xs text-amber-700 font-medium">
                {task.verifier_name ? `Assigned Verifier: ${verifierName} (${verifierRole})` : 'Task updated to Under Review'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5 space-y-2">
          <p className="text-xs font-bold text-gray-900 truncate">{task.title}</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Great work! In accordance with company workflow rules, completed tasks require review and verification by <span className="font-semibold text-gray-900">{verifierName}</span> before final completion.
          </p>
          <p className="text-xs text-amber-900 font-medium pt-1">
            Please message or call {verifierName} to set up a quick review meeting.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="btn-amber text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs w-full"
          >
            <MessageSquare className="w-4 h-4" />
            Message {verifierName} on WhatsApp
          </a>
          <button
            onClick={onClose}
            className="btn-primary text-xs py-2.5 px-4 rounded-xl text-gray-700 hover:bg-gray-100 w-full sm:w-auto shrink-0"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
