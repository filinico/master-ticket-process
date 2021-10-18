import {convertScriptResults} from '../src/gitRepo'

test('convert multiple script results to array', async () => {
  const result1 = convertScriptResults('XX-123, XX-456\n')
  expect(result1).toEqual(['XX-123', 'XX-456'])
})

test('convert single script result to array', async () => {
  const result5 = convertScriptResults('XX-123\n')
  expect(result5).toEqual(['XX-123'])
})

test('No results, convert to empty array', async () => {
  const result2 = convertScriptResults('\r\n')
  expect(result2).toEqual([])
  const result3 = convertScriptResults(' \n ')
  expect(result3).toEqual([])
})
