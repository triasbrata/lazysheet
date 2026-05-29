import type { CSSProperties } from 'react'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faApple,
  faWindows,
  faLinux,
  faGithub,
} from '@fortawesome/free-brands-svg-icons'
import {
  faDownload,
  faLock,
  faBolt,
  faCircleCheck,
  faLayerGroup,
  faPalette,
  faCopy,
  faTerminal,
  faFileExcel,
  faFileCsv,
  faFileLines,
} from '@fortawesome/free-solid-svg-icons'

type IconProps = { className?: string; style?: CSSProperties }

// Size via font-size (FA svg is height: 1em) → use Tailwind text-[..] / text-primary.
function make(icon: IconDefinition) {
  return function Mark({ className, style }: IconProps) {
    return <FontAwesomeIcon icon={icon} className={className} style={style} />
  }
}

// Brand marks
export const AppleMark = make(faApple)
export const WindowsMark = make(faWindows)
export const LinuxMark = make(faLinux)
export const GithubMark = make(faGithub)

// UI / feature marks
export const DownloadIcon = make(faDownload)
export const LockIcon = make(faLock)
export const BoltIcon = make(faBolt)
export const CheckIcon = make(faCircleCheck)
export const LayersIcon = make(faLayerGroup)
export const PaletteIcon = make(faPalette)
export const CopyIcon = make(faCopy)
export const TerminalIcon = make(faTerminal)

// File-format marks
export const ExcelIcon = make(faFileExcel)
export const CsvIcon = make(faFileCsv)
export const TsvIcon = make(faFileLines)
