import { Check, X } from "lucide-react";

type PricingModalProps = {
  open: boolean;
  onClose: () => void;
};

const pricingPlans = [
  {
    title: "Free 计划",
    price: "$0 / 月",
    features: ["1 次 AI 问诊/日", "基础模型匹配"],
    buttonText: "当前计划 Current Plan",
    buttonClass:
      "w-full bg-slate-200 text-slate-500 cursor-not-allowed rounded-xl py-3",
    disabled: true,
    cardClass: "bg-slate-50 border border-slate-200",
    badgeText: null,
  },
  {
    title: "Plus 计划",
    price: "$9.9 / 月",
    features: ["10 次 AI 问诊/日", "解锁高级专科匹配", "图文病历极速生成"],
    buttonText: "升级至 Plus",
    buttonClass:
      "w-full bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl py-3 transition-colors",
    disabled: false,
    cardClass: "bg-white border border-teal-200/80 shadow-sm",
    badgeText: null,
  },
  {
    title: "Pro 计划",
    price: "$29.9 / 月",
    features: ["无限制 AI 问诊", "每月 1 次名医图文问诊免单", "专属健康管家"],
    buttonText: "升级至 Pro",
    buttonClass:
      "w-full bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl py-3 transition-colors",
    disabled: false,
    cardClass: "bg-white border border-teal-200/80",
    badgeText: null,
  },
];

export default function PricingModal({ open, onClose }: PricingModalProps) {
  if (!open) return null;

  return (
  <div className="bg-slate-900/50 backdrop-blur-sm z-50 fixed inset-0 flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 z-0"
        aria-label="关闭订阅弹窗"
      />
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-5xl overflow-hidden relative p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">升级您的 MediBridge 计划</h2>
          <p className="text-slate-500 mt-2">选择最适合您的 AI 医疗助手</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {pricingPlans.map(plan => (
            <section key={plan.title} className={`relative p-6 rounded-2xl ${plan.cardClass}`}>
              {plan.badgeText ? (
                <div className="bg-slate-900 text-white text-xs px-3 py-1 rounded-full absolute -top-3 left-1/2 -translate-x-1/2">
                  {plan.badgeText}
                </div>
              ) : null}

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-slate-900">{plan.title}</h3>
                <p className="text-3xl font-bold text-slate-900">{plan.price}</p>

                <ul className="space-y-3">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={plan.disabled}
                  className={plan.buttonClass}
                  onClick={onClose}
                >
                  {plan.buttonText}
                </button>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
