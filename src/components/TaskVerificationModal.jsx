import { useState } from 'react';
import { ShieldCheck, MessageSquare, X, Clock, Award, Copy, Check, ExternalLink } from 'lucide-react';

export default function TaskVerificationModal({ isOpen, onClose, task }) {
  const [achievements, setAchievements] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !task) return null;

  const rawVerifier = task.verifier_name || task.mentor_name;
  const isNamedVerifier = rawVerifier && rawVerifier.toLowerCase() !== 'admin';
  const verifierName = isNamedVerifier ? rawVerifier : 'Reviewer and Verifier';
  const verifierRole = task.verifier_role || 'Verifier';

  const generateWhatsAppMessage = () => {
    const salutation = isNamedVerifier ? `Hi ${verifierName}` : `Hi Reviewer and Verifier`;
    let msg = `${salutation},\n\nI have completed the task on DoneIt:\n📌 *${task.title}*`;

    if (achievements.trim()) {
      msg += `\n\n🏆 *Key Achievements & Summary:*\n${achievements.trim()}`;
    }

    msg += `\n\nPlease let me know when you are available for a quick review meeting so I can show you my work and we can verify it fast. Thank you!`;
    return msg;
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(generateWhatsAppMessage())}`;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(generateWhatsAppMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base">
                Task Verification Required
              </h3>
              <p className="text-xs text-amber-700 font-medium">
                Assigned: {isNamedVerifier ? `${verifierName} (${verifierRole})` : 'Reviewer and Verifier'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3.5 space-y-2">
          <p className="text-xs font-bold text-gray-900 truncate">{task.title}</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Great work! In accordance with company workflow rules, completed tasks require review and verification by <span className="font-semibold text-gray-900">{isNamedVerifier ? verifierName : 'your Reviewer and Verifier'}</span> before final completion.
          </p>
        </div>

        {/* Guidance Box */}
        <div className="bg-blue-50/80 border border-blue-200/90 rounded-xl p-3 text-xs space-y-1 text-blue-950">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-blue-900">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Verification Meeting Guidance</span>
          </div>
          <p className="text-[11px] text-blue-950 leading-relaxed font-medium">
            Show your work with your reviewer and verifier at a given time. Be specific and clear with your task — it should finish fast.
          </p>
        </div>

        {/* Achievements input */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span>Key Achievements & Deliverables (Optional)</span>
          </label>
          <textarea
            value={achievements}
            onChange={(e) => setAchievements(e.target.value)}
            placeholder="Highlight what you achieved, deliverables ready for review, demo link, etc..."
            rows={3}
            className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-hidden bg-gray-50/50 focus:bg-white resize-y"
          />
        </div>

        {/* WhatsApp Button & Action */}
        <div className="bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-800 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
              <span>Connect on WhatsApp</span>
            </span>
            <button
              type="button"
              onClick={handleCopyMessage}
              className="text-[11px] text-gray-600 hover:text-gray-900 flex items-center gap-1 bg-white border border-gray-200 px-2 py-0.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
              <span>{copied ? 'Copied!' : 'Copy Msg'}</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-600 leading-normal">
            Request a review meeting time with {isNamedVerifier ? verifierName : 'your Reviewer and Verifier'} on WhatsApp to show your work and complete verification fast.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 fill-current" />
            <span>Open WhatsApp to Request Meeting Time</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="btn-primary text-xs py-2 px-4 rounded-xl text-gray-700 hover:bg-gray-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
