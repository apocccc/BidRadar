import { useState, useEffect, useRef } from 'react';

export const PREFECTURES = [
  { code: '01', name: '北海道' }, { code: '02', name: '青森県' }, { code: '03', name: '岩手県' },
  { code: '04', name: '宮城県' }, { code: '05', name: '秋田県' }, { code: '06', name: '山形県' },
  { code: '07', name: '福島県' }, { code: '08', name: '茨城県' }, { code: '09', name: '栃木県' },
  { code: '10', name: '群馬県' }, { code: '11', name: '埼玉県' }, { code: '12', name: '千葉県' },
  { code: '13', name: '東京都' }, { code: '14', name: '神奈川県' }, { code: '15', name: '新潟県' },
  { code: '16', name: '富山県' }, { code: '17', name: '石川県' }, { code: '18', name: '福井県' },
  { code: '19', name: '山梨県' }, { code: '20', name: '長野県' }, { code: '21', name: '岐阜県' },
  { code: '22', name: '静岡県' }, { code: '23', name: '愛知県' }, { code: '24', name: '三重県' },
  { code: '25', name: '滋賀県' }, { code: '26', name: '京都府' }, { code: '27', name: '大阪府' },
  { code: '28', name: '兵庫県' }, { code: '29', name: '奈良県' }, { code: '30', name: '和歌山県' },
  { code: '31', name: '鳥取県' }, { code: '32', name: '島根県' }, { code: '33', name: '岡山県' },
  { code: '34', name: '広島県' }, { code: '35', name: '山口県' }, { code: '36', name: '徳島県' },
  { code: '37', name: '香川県' }, { code: '38', name: '愛媛県' }, { code: '39', name: '高知県' },
  { code: '40', name: '福岡県' }, { code: '41', name: '佐賀県' }, { code: '42', name: '長崎県' },
  { code: '43', name: '熊本県' }, { code: '44', name: '大分県' }, { code: '45', name: '宮崎県' },
  { code: '46', name: '鹿児島県' }, { code: '47', name: '沖縄県' },
];

export default function PrefectureMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter(c => c !== code) : [...value, code]);
  };

  const label =
    value.length === 0
      ? '// 全国'
      : value.length === 1
      ? PREFECTURES.find(p => p.code === value[0])?.name ?? ''
      : `${value.length}都道府県`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="border border-gray-200 bg-white text-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition flex items-center gap-1.5 whitespace-nowrap"
      >
        {label}
        <span className="text-gray-400 text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 w-44 max-h-72 overflow-y-auto p-1.5">
          <label className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded cursor-pointer">
            <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} />
            全国
          </label>
          <hr className="my-1 border-gray-100" />
          {PREFECTURES.map(p => (
            <label key={p.code} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(p.code)}
                onChange={() => toggle(p.code)}
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
