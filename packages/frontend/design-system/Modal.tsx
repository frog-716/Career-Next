import {useEffect,useRef,type ReactNode} from 'react';
/** Native modal top layer supplies background inertness and keyboard focus containment. */
export function Modal({label,busy=false,onCancel,children}:{label:string;busy?:boolean;onCancel():void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null,dialog=ref.current;if(!dialog)return;dialog.showModal();dialog.querySelector<HTMLElement>('[data-dialog-cancel]')?.focus();return()=>{dialog.close();if(previous?.isConnected)previous.focus({preventScroll:true});};},[]);
 return <dialog ref={ref} aria-label={label} aria-modal="true" style={{maxWidth:680,maxHeight:'85vh',overflow:'auto'}} onCancel={event=>{event.preventDefault();if(!busy)onCancel();}}>{children}</dialog>;
}
