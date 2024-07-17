import {Pipe, PipeTransform} from '@angular/core'

const units = [
  {unit: 'd', value: 86_400_000},
  {unit: 'h', value: 3_600_000},
  {unit: 'm', value: 60_000},
  {unit: 's', value: 1_000},
  {unit: 'ms', value: 1},
]

@Pipe({
  name: 'elapsed',
  standalone: true,
})
export class ElapsedPipe implements PipeTransform {
  transform(elapsedTimeMs: number): string {
    let remainingTime = elapsedTimeMs
    let result = units.map(({unit, value}) => {
      if (remainingTime >= value) {
        const amount = Math.floor(remainingTime / value)
        remainingTime -= amount * value
        return `${amount}${unit}`
      }
      return ''
    }).filter(Boolean).join(' ')

    return result || '0ms'
  }

}
