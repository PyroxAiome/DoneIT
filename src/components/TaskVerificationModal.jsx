import { CheckCircle2, Calendar, X, Sparkles, ShieldCheck } from 'lucide-react';

export default function TaskVerificationModal({ isOpen, onClose, task, currentUser }) {
  if (!isOpen || !task) return null;

  const handleScheduleMeeting = () => {
    const title = `Admin Task Review Sync: ${task.title}`;
    const details = `Review & Verification Sync for Task: "${task.title}"\nAssignee: ${currentUser?.name || 'Employee'}\nTask Category: ${task.category || 'General'}\nStatus: Under Review\n\nPlease review deliverable details before final Admin sign-off.`;
    
    // Google Calendar template URL
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}`;
    window.open(googleCalUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 transform transition-all scale-100">
        
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-xl border border-white/20">
              <Sparkles className="w-7 h-7 text-amber-200" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-100 border border-amber-300/30 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Verification Workflow
              </span>
              <h2 className="text-xl font-bold tracking-tight">Deliverables Submitted for Review</h2>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-5">
          <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-xs text-purple-900 space-y-1">
              <p className="font-semibold text-sm text-purple-950">
                Task: <span className="font-bold underline decoration-purple-300 decoration-2">{task.title}</span>
              </p>
              <p className="text-purple-700">
                Status updated to <span className="font-semibold text-purple-900 bg-purple-200/60 px-1.5 py-0.5 rounded">Under Review</span>
              </p>
            </div>
          </div>

          <div className="space-y-3 text-gray-600 text-sm leading-relaxed bg-gray-50/60 p-4 rounded-xl border border-gray-100">
            <p className="font-medium text-gray-800">
              🌟 <strong className="text-gray-900">Great work on completing your deliverables!</strong>
            </p>
            <p className="text-xs text-gray-600 leading-normal">
              To maintain our high quality standards and ensure seamless organizational alignment, completed tasks require a final review and sign-off from an Administrator.
            </p>
            <p className="text-xs text-gray-600 leading-normal">
              Please present this task during your aligned review sync with the Admin so they can formally verify and mark it as <strong className="text-emerald-700 font-semibold">Completed</strong>.
            </p>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleScheduleMeeting}
              className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium text-sm rounded-xl shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30 active:scale-[0.98]"
            >
              <Calendar className="w-4 h-4" />
              Schedule Review Sync
            </button>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
