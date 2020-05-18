.PHONY: main
ifndef VERBOSE
.SILENT:
endif

############## Main build ##############

main: out/main

dev: out/main
	./out/main data/reference-long.wav data/recorded-long.wav out/output.wav

out/main: *.h main.cpp
	echo "building";
	mkdir -p out
	g++ -std=c++11 -Wall -Wextra -Wfatal-errors -g -O3 \
 		-Wpedantic -pedantic-errors \
		main.cpp \
		-o out/main

############## Clean ##############

clean:
	rm -rf out
