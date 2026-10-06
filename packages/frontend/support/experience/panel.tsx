import '../../design-system/aura-approved.css';
import './experience.css';
import {NavigationIcon} from '../../design-system/NavigationIcon';
import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
/** Keeps its children mounted; native dialog supplies focus trapping without unmounting business views. */
export function AuxiliaryPanel({open,label,onClose,children,footer,small=false,modal=true}:{modal?:boolean;small?:boolean;footer?:ReactNode;open:boolean;label:string;onClose():void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),focus=useRef<HTMLElement|null>(null),range=useRef<Range|null>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;
  if(open){focus.current=document.activeElement as HTMLElement;const selection=window.getSelection();range.current=selection?.rangeCount?selection.getRangeAt(0).cloneRange():null;if(modal)dialog.showModal();else dialog.show();dialog.querySelector<HTMLElement>('[data-panel-close]')?.focus();}
  else if(dialog.open){dialog.close();const original=focus.current;if(original?.isConnected){original.focus({preventScroll:true});if(range.current&&original.isContentEditable){try{const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range.current);}catch{/* A replaced owner DOM cannot restore a stale range. */}}}}
 },[open,modal]);
 useEffect(()=>()=>{ref.current?.close();},[]);
 return createPortal(<dialog className={'career-aux-panel'+(modal?'':' career-nonmodal-panel')} ref={ref} aria-label={label} aria-modal={modal?'true':undefined} onCancel={event=>{event.preventDefault();onClose();}}><div className={'overlay'+(open?' open':'')}><div className="scrim" onMouseDown={e=>e.preventDefault()} onClick={onClose}/><div className={'sheet'+(small?' small-sheet':'')}><header className="sheet-header"><h2>{label}</h2><button className="icon-button" aria-label="返回原任务" data-panel-close onClick={onClose}><NavigationIcon name="close"/></button></header><div className="sheet-body">{children}</div>{footer&&<footer className="sheet-footer">{footer}</footer>}</div></div></dialog>,document.body);
}
