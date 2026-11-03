import React from 'react'
import { ObserveScreen } from './ObserveScreen'

type Props = {
  ip: string
  onBack: () => void
}

export const ControlScreen: React.FC<Props> = ({ ip, onBack }) => (
  <ObserveScreen
    ip={ip}
    car={1}
    onCarChange={() => {}}
    onBack={onBack}
    presentation="control"
  />
)
