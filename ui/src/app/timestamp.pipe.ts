import {Pipe, PipeTransform} from '@angular/core'
import {DateTime} from 'luxon'

@Pipe({
  name: 'timestamp',
  standalone: true,
})
export class TimestampPipe implements PipeTransform {

  transform(timestamp: number): string {
    return DateTime.fromMillis(timestamp).toFormat('M/d h:mm:ss a').toLowerCase()
  }

}
