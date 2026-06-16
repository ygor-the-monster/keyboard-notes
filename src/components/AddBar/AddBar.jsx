import { Text, Divider } from "@react-spectrum/s2";
import {
  Article,
  MusicNotes,
  Image as ImageIcon,
  FilePdf,
  Waveform,
  Plus,
} from "@phosphor-icons/react";
import { useStore } from "../../providers/StoreProvider/StoreProvider.jsx";
import { useEditing } from "../../providers/EditingProvider/EditingProvider.jsx";
import IconBtn from "../IconBtn/IconBtn.jsx";
import { dividerLine } from "./AddBar.styled.jsx";
import s from "./AddBar.module.css";

const ITEMS = [
  { type: "md", icon: Article, label: "Add note" },
  { type: "abc", icon: MusicNotes, label: "Add music staff" },
  { type: "img", icon: ImageIcon, label: "Add image" },
  { type: "pdf", icon: FilePdf, label: "Add PDF" },
  { type: "snd", icon: Waveform, label: "Add audio" },
];

export default function AddBar() {
  const { addCell } = useStore();
  const { setEditing } = useEditing();
  return (
    <div className={`${s.wrap} no-print`}>
      <div className={s.label}>
        <Divider styles={dividerLine} />
        <Plus size={16} aria-hidden />
        <Text>Add a cell</Text>
        <Divider styles={dividerLine} />
      </div>
      <div className={s.row}>
        {ITEMS.map((it) => (
          <IconBtn
            key={it.type}
            icon={it.icon}
            label={it.label}
            isQuiet={false}
            buttonSize="XL"
            size={24}
            onPress={() => setEditing(addCell(it.type))}
          />
        ))}
      </div>
    </div>
  );
}
