// The loading screen shown while a page fetches its data:
// three gold bars rising in turn, with a quiet label under them.
export default function Loader(props: { label?: string }) {
  return (
    <div className="hm-loader" role="status" aria-live="polite">
      <span className="hm-loader-bars" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>
      <span className="font-['Tajawal'] text-sm text-[#4A473F]">{props.label || 'جاري التحميل...'}</span>
    </div>
  )
}
