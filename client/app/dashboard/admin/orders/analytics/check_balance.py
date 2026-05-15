
import sys

def check_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    braces = 0
    parens = 0
    brackets = 0
    
    for i, char in enumerate(content):
        if char == '{': braces += 1
        elif char == '}': braces -= 1
        elif char == '(': parens += 1
        elif char == ')': parens -= 1
        elif char == '[': brackets += 1
        elif char == ']': brackets -= 1
        
        if braces < 0: print(f"Unmatched }} at char {i}")
        if parens < 0: print(f"Unmatched ) at char {i}")
        if brackets < 0: print(f"Unmatched ] at char {i}")
        
    print(f"Final counts: Braces: {braces}, Parens: {parens}, Brackets: {brackets}")

if __name__ == "__main__":
    check_balance(sys.argv[1])
