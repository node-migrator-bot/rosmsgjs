EXAMPLE = example/how_to.js

# Runs and prints out How To examples as HTML.
example:
	@./node_modules/.bin/mocha \
		--reporter doc \
		$(EXAMPLE)

# Ignores directories with the same name as targets.
.PHONY: example

