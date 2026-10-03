// Wraps every page, so each page fades and rises in gently when it opens.
// The animation has no fill, so once it ends the wrapper has no transform
// left on it and pop-up windows (position: fixed) inside it behave normally.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="hm-page-enter">{children}</div>
}
