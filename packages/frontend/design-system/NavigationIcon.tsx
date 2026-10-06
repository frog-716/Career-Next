// Exact vector paths from the approved A6 prototype; never user-provided markup.
const paths={
  "sort":"<path d=\"m8 8 4-4 4 4M12 4v16m-4-4 4 4 4-4\"/>",
  "changelog":"<path class=\"icon-wash\" d=\"M7 5h11v15H7Z\"/><path d=\"M6 4h12a1 1 0 0 1 1 1v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 4v17M10 8h5M10 12h5M10 16h3\"/>",
  "wiki": "<path class=\"icon-wash\" d=\"M6 4h13v13H6Z\"/><path d=\"M5 19a2.4 2.4 0 0 1 2.4-2.4H19V4H7.4A2.4 2.4 0 0 0 5 6.4V19a2 2 0 0 0 2 2h12\"/><path d=\"M9 8h6M9 11.5h4\"/>",
  "opportunity": "<circle class=\"icon-wash\" cx=\"12\" cy=\"12\" r=\"4.5\"/><circle cx=\"12\" cy=\"12\" r=\"8.5\"/><circle cx=\"12\" cy=\"12\" r=\"4.5\"/><path d=\"M12 3.5v1M20.5 12h-1M12 20.5v-1M3.5 12h1\"/><circle cx=\"12\" cy=\"12\" r=\".7\"/>",
  "project": "<path class=\"icon-wash\" d=\"M4 9h16v10H4Z\"/><path d=\"M3.5 7.5V5h6l2.3 2.5h8.7V19a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19V7.5Z\"/><path d=\"M3.5 10h17\"/>",
  "employment": "<path class=\"icon-wash\" d=\"M4 10h16v10H4Z\"/><rect x=\"3.5\" y=\"5.5\" width=\"17\" height=\"15\" rx=\"2\"/><path d=\"M8 3.5v4M16 3.5v4M3.5 10.5h17M8 14.5h2M14 14.5h2M8 17.5h2\"/>",
  "person": "<circle cx=\"12\" cy=\"8\" r=\"3.5\" fill=\"#d0ded4\"/><path d=\"M5 20v-1a7 7 0 0 1 14 0v1\"/>",
  "settings": "<path d=\"m9.6 3-.7 2.4-2.1 1.2-2.4-.6-1.9 3.2 1.7 1.8v2l-1.7 1.8 1.9 3.2 2.4-.6 2.1 1.2.7 2.4h4.8l.7-2.4 2.1-1.2 2.4.6 1.9-3.2-1.7-1.8v-2l1.7-1.8L19.6 6l-2.4.6-2.1-1.2-.7-2.4Z\"/><circle class=\"icon-wash\" cx=\"12\" cy=\"12\" r=\"3\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
  "help": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><path d=\"M9.5 9.4a2.6 2.6 0 0 1 5.1.5c0 1.9-2.6 2-2.6 4M12 17h.01\"/>",
  "feedback": "<path d=\"M5.5 4.5h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5.5 3v-15a2 2 0 0 1 2-2Z\"/><path d=\"M8 9h8M8 13h5\"/>",
  "more": "<circle cx=\"5\" cy=\"12\" r=\".7\"/><circle cx=\"12\" cy=\"12\" r=\".7\"/><circle cx=\"19\" cy=\"12\" r=\".7\"/>",
  "search": "<circle cx=\"10\" cy=\"10\" r=\"6\"/><path d=\"m15 15 6 6\"/>",
  "arrow": "<path d=\"M5 12h14m-5-5 5 5-5 5\"/>"
} as const;
export type CareerIconName=keyof typeof paths;
export function NavigationIcon({name}:{name:CareerIconName}){return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{__html:paths[name]}}/>;}
